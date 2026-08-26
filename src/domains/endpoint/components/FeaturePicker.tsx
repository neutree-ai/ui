import { Check, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
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
import { cn } from "@/foundation/lib/utils";
import type {
  FeatureSelection,
  RecipeFeature,
} from "@/foundation/recipe/types";

type Props = {
  /** Ordered feature list; list position is the display order and items are
   * grouped into sections by `group` (sections in first-seen order). Always
   * pass the FULL list so conflict checks and the ordered commit stay correct
   * even when `renderGroups` shows only a subset. */
  features: RecipeFeature[];
  /** Currently selected features, in order (order matters for compose). */
  value: FeatureSelection[];
  onChange: (next: FeatureSelection[]) => void;
  disabled?: boolean;
  /** If set, only render these group labels (others are hidden but still
   * considered for conflicts/commit). Lets the same selection state drive a
   * promoted "core" group up in the form grid and the rest below. */
  renderGroups?: string[] | null;
  /** "stack" (default) renders label-beside-control rows under a heading;
   * "grid" renders heading-less label-above-control cells in a 2-col grid, so a
   * promoted group reads like ordinary form fields (matches the deploy mockup). */
  layout?: "stack" | "grid";
  /**
   * An extra control rendered beside an input feature's own control, for
   * features the caller recognises. Returning nothing leaves the feature
   * exactly as it was.
   *
   * Beside rather than instead: a feature's `suggestions` are the catalog
   * author's recommendations and an addon is a way to go and find something
   * else, which are complementary rather than alternatives. Replacing the
   * control would also mean re-implementing SuggestInput to keep them.
   *
   * Which features deserve one is the caller's judgement — recognising them
   * needs to know the engine, and a generic feature renderer has no business
   * holding that.
   */
  inputAddon?: (
    feature: RecipeFeature,
    props: { value: string; onChange: (value: string) => void },
  ) => ReactNode;
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
  widthClass = "w-44",
}: {
  value: string;
  /** Presets with a raw `value` (what gets composed) and a display `label`
   * (e.g. "8K" for "8192"). */
  suggestions: { value: string; label: string }[];
  numeric: boolean;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel: string;
  onCommit: (value: string) => void;
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const trimmed = draft.trim();
  // Match the typed text against either the raw value or the friendly label.
  const matches = trimmed
    ? suggestions.filter(
        (s) => s.value.includes(trimmed) || s.label.includes(trimmed),
      )
    : suggestions;
  const exact = suggestions.find(
    (s) => s.value === trimmed || s.label === trimmed,
  );
  const showCustom = trimmed !== "" && !exact;
  // Show the preset's label when the current value matches one; else the raw
  // value (a freely-typed custom number).
  const display = suggestions.find((s) => s.value === value)?.label ?? value;

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
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          className={cn("h-9 shrink-0 justify-between font-normal", widthClass)}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {display || placeholder || ""}
          </span>
          <ChevronsUpDown className="ml-2 size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0", widthClass)} align="end">
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
                <CommandItem
                  value={`__use__${trimmed}`}
                  onSelect={() => commit(trimmed)}
                >
                  Use “{trimmed}”
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {matches.map((s) => (
                <CommandItem
                  key={s.value}
                  value={s.value}
                  onSelect={() => commit(s.value)}
                >
                  {s.label}
                  {s.label !== s.value && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {s.value}
                    </span>
                  )}
                  <Check
                    className={cn(
                      "ml-auto size-4",
                      value === s.value ? "opacity-100" : "opacity-0",
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
  renderGroups,
  layout = "stack",
  inputAddon,
}: Props) => {
  const grid = layout === "grid";
  const { t } = useTranslation();
  const entries: [string, RecipeFeature][] = features
    .filter((f) => f?.name)
    .map((f) => [f.name, f]);
  if (entries.length === 0) return null;

  const byKey = new Map(entries);
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
    const f = byKey.get(key);
    const fc = new Set(f?.conflicts_with ?? []);
    for (const other of active) {
      if (other === key) continue;
      if (fc.has(other)) return other;
      const oc = new Set(byKey.get(other)?.conflicts_with ?? []);
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
      const suggestions = (f.input?.suggestions ?? [])
        .map((s) =>
          typeof s === "string"
            ? { value: s, label: s }
            : { value: s.value, label: s.label || s.value },
        )
        .filter((s) => s.value);
      const commitValue = (val: string) =>
        setSel(
          key,
          val === "" && !required ? undefined : { name: key, value: val },
        );
      const addon = inputAddon?.(f, { value: current, onChange: commitValue });
      return (
        <div
          key={key}
          className={
            grid ? "space-y-1.5" : "flex items-start justify-between gap-3"
          }
        >
          {renderHeader(key, f, conflict)}
          <div
            className={cn(
              "flex items-center gap-2",
              grid ? "w-full" : "shrink-0",
            )}
          >
            {suggestions.length > 0 ? (
              <SuggestInput
                ariaLabel={key}
                value={current}
                suggestions={suggestions}
                numeric={numeric}
                placeholder={f.input?.default ?? ""}
                disabled={itemDisabled}
                onCommit={commitValue}
                widthClass={grid ? "w-full" : "w-44"}
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
                className={cn("h-9", grid ? "w-full" : "w-44")}
              />
            )}
            {addon}
          </div>
        </div>
      );
    }

    return (
      <div
        key={key}
        className={
          grid ? "space-y-1.5" : "flex items-start justify-between gap-3"
        }
      >
        {renderHeader(key, f, conflict)}
        <Switch
          aria-label={key}
          checked={isActive}
          disabled={itemDisabled}
          onCheckedChange={(on) => setSel(key, on ? { name: key } : undefined)}
          className={grid ? "" : "mt-0.5 shrink-0"}
        />
      </div>
    );
  };

  // Group features into sections by `group` (first-seen order; items keep list
  // order). Ungrouped features share an implicit default section that carries
  // no heading, rendered at its first-seen position.
  const groupOrder: string[] = [];
  const grouped = new Map<string, [string, RecipeFeature][]>();
  for (const entry of entries) {
    const g = entry[1].group ?? "";
    if (!grouped.has(g)) {
      grouped.set(g, []);
      groupOrder.push(g);
    }
    grouped.get(g)?.push(entry);
  }

  // Optionally restrict which groups this instance displays (conflicts/commit
  // still consider every feature above). Bail out if nothing is left to show.
  const visibleGroups = renderGroups
    ? groupOrder.filter((g) => renderGroups.includes(g))
    : groupOrder;
  if (visibleGroups.length === 0) return null;

  // Grid layout: heading-less 2-col cells so a promoted group reads like form
  // fields (matches the mockup). Stack layout: the sectioned list with headings.
  if (grid) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visibleGroups.flatMap((g) => grouped.get(g) ?? []).map(renderItem)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {visibleGroups.map((g, i) => {
        const items = grouped.get(g) ?? [];
        return (
          <div
            key={g || "__default__"}
            className={cn("space-y-4", i > 0 && "pt-4 border-t")}
          >
            {g && (
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {g}
              </div>
            )}
            {items.map(renderItem)}
          </div>
        );
      })}
    </div>
  );
};
