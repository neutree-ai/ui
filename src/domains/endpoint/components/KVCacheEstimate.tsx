import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  type EngineCacheArgControls,
  type EngineCacheArgs,
  NO_ENGINE_CACHE_ARG_CONTROLS,
  NO_ENGINE_CACHE_ARGS,
} from "@/domains/endpoint/lib/engine-cache-args";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { InfoHint } from "@/foundation/components/InfoHint";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  BYTES_PER_GB,
  defaultPrecisionId,
  defaultRecurrentStatePrecisionId,
  estimateKvCache,
  KV_CACHE_PRECISIONS,
  type KvCacheComponent,
  type KvCacheFactor,
  type KvCachePrecisionId,
  type KvCacheResult,
  type KvCacheSource,
  type LinearStateCheckpointPolicy,
} from "@/foundation/lib/kv-cache";
import type { ModelInfoRead } from "@/foundation/lib/model-info-read";
import { modelFieldSource } from "@/foundation/types/model-types";
import type { ModelInfo } from "@/foundation/types/serving-types";

export type KVCacheEstimateState =
  | {
      kind: "ready";
      totalGb: number;
      tokensPerSequence: number | null;
      sequences: number | null;
      precision: KvCachePrecisionId | "";
      family: string;
    }
  | {
      kind: "unavailable";
      reason: string;
      missingFields?: string[];
    };

/**
 * KV cache size for the selected model, shown with the formula it came from.
 *
 * Everything on screen is traceable: each number is labelled with the checkpoint
 * field it was read from and how that field was established, and the formula is
 * written out so a user can redo the multiplication. The panel holds no state
 * the deployment reads — it is a calculator next to the form, not an input to it.
 *
 * When the estimate cannot be made it says which field is missing and stops.
 * There is no fallback number: the caller is sizing hardware, and a guess they
 * cannot distinguish from a computed figure is the one outcome worth avoiding.
 */

/** Local number entry: blank and non-numeric are "not answered", not zero. */
const parseCount = (raw: string): number | null => {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return null;
  }

  const value = Number(trimmed.replace(/,/g, ""));

  return Number.isFinite(value) ? value : null;
};

const groupedNumber = new Intl.NumberFormat("en");

/** What the tokens/sequences fields actually track — digits only, never a
 * grouped comma. Stripped on the way in so a pasted "163,840" still parses,
 * and formatting is purely a display concern layered on top of this. */
const stripGrouping = (raw: string): string => raw.replace(/,/g, "");

/**
 * How a raw count reads at a glance: 163840 is not a number anyone can place
 * a magnitude on by eye, and thousands-heavy VRAM sizing is exactly where
 * that matters. Left alone (not grouped) whenever the digits-only form is not
 * a plain non-negative integer — a value mid-edit, or one this field never
 * produces on its own — so a user typing is never fighting a reformat of
 * something that is not a finished number yet.
 */
const formatGroupedInput = (raw: string): string => {
  const digits = stripGrouping(raw);

  return /^\d+$/.test(digits) ? groupedNumber.format(Number(digits)) : raw;
};

/** How many digits (not commas) precede `index` in a possibly-grouped string
 * — the unit the caret is tracked in, since it is what stays meaningful
 * across a reformat that only ever inserts or removes commas. */
const digitsBefore = (text: string, index: number): number =>
  (text.slice(0, index).match(/\d/g) ?? []).length;

/** The inverse: where the caret lands in `text` after `count` digits, so
 * typing or deleting anywhere in the field keeps the caret next to the same
 * digit once the grouped commas shift around it. */
const caretAfterDigits = (text: string, count: number): number => {
  if (count <= 0) return 0;

  let seen = 0;

  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i])) {
      seen++;
      if (seen === count) return i + 1;
    }
  }

  return text.length;
};
const compactNumber = new Intl.NumberFormat("en", {
  maximumSignificantDigits: 3,
});
const percent = new Intl.NumberFormat("en", {
  style: "percent",
  maximumFractionDigits: 0,
});

const bytesOf = (id: KvCachePrecisionId | ""): number | null =>
  KV_CACHE_PRECISIONS.find((precision) => precision.id === id)?.bytes ?? null;

/** Provenance is an annotation on a factor, not another factor. Keeping it
 * outside the split tag and at caption weight preserves the distinction without
 * making every row read as three equally important values. */
const SourceNote = ({ source }: { source: KvCacheSource }) => {
  const { t } = useTranslation();

  if (source !== "derived" && source !== "manual" && source !== "deployment") {
    return null;
  }

  return (
    <span
      className="text-[10px] font-normal text-muted-foreground/75"
      data-segment="source"
      title={t(`endpoints.kvCache.sourceHints.${source}`)}
    >
      ({t(`endpoints.kvCache.sources.${source}`)})
    </span>
  );
};

const FactorTerm = ({
  factorKey,
  value,
  source,
}: {
  factorKey: string;
  value: number;
  source: KvCacheSource;
}) => {
  const { t } = useTranslation();
  const sourceHint =
    source === "unstated"
      ? t(`endpoints.kvCache.sourceHints.${source}`)
      : undefined;

  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[11px] leading-4"
      title={sourceHint}
    >
      <span
        className="inline-flex overflow-hidden rounded-[var(--nt-radius-checkbox)] border bg-background"
        data-testid={`kv-cache-factor-${factorKey}`}
        data-formula-tag
      >
        <span
          className="inline-flex items-center bg-[var(--nt-fill-neutral-opaque-1)] px-1.5 py-1 text-muted-foreground"
          data-segment="label"
        >
          {t(`endpoints.kvCache.factors.${factorKey}`)}
        </span>
        <span
          className="inline-flex items-center border-l bg-background px-1.5 py-1 font-medium tabular-nums text-foreground"
          data-segment="value"
        >
          {groupedNumber.format(value)}
        </span>
      </span>
      <SourceNote source={source} />
    </span>
  );
};

const Factor = ({ factor }: { factor: KvCacheFactor }) => {
  const { t } = useTranslation();

  if (factor.kind === "sum" || factor.kind === "min") {
    return (
      <span className="inline-flex min-w-0 flex-wrap items-center gap-1 font-mono text-[11px] leading-4">
        {factor.kind === "min" ? (
          <span className="font-medium text-muted-foreground">min</span>
        ) : null}
        <span className="text-muted-foreground">(</span>
        {factor.terms.map((term, index) => (
          <span key={term.key} className="inline-flex items-center gap-1">
            {index > 0 ? (
              <span className="text-muted-foreground">
                {factor.kind === "min" ? "," : "+"}
              </span>
            ) : null}
            <FactorTerm
              factorKey={term.key}
              value={term.value}
              source={term.source}
            />
          </span>
        ))}
        <span className="text-muted-foreground">)</span>
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <span className="text-muted-foreground">=</span>
          <span className="rounded-[var(--nt-radius-checkbox)] border bg-muted/35 px-1.5 py-1 font-medium tabular-nums">
            {groupedNumber.format(factor.value)}
          </span>
        </span>
      </span>
    );
  }

  if (factor.source === "derived" && factor.from) {
    return (
      <span
        className="whitespace-nowrap"
        title={t("endpoints.kvCache.countedFrom", "Counted out of {{field}}", {
          field: factor.from,
        })}
      >
        <FactorTerm
          factorKey={factor.key}
          value={factor.value}
          source={factor.source}
        />
      </span>
    );
  }

  return (
    <FactorTerm
      factorKey={factor.key}
      value={factor.value}
      source={factor.source}
    />
  );
};

/**
 * The default width a sparse-attention indexer's entries are held at. Like the
 * checkpoint-interval default it is a serving convention rather than anything
 * the config states, and it is the starting value of an input the user owns.
 */
const DEFAULT_INDEXER_PRECISION: KvCachePrecisionId = "fp4";

/**
 * Which extra inputs a checkpoint calls for. Each one is keyed on a statement in
 * the checkpoint rather than on the family the estimator settled on: the family
 * depends on these inputs, so reading it back to decide which to render would be
 * circular, and a model that states none of them keeps the panel it had.
 */
const hasLinearAttention = (info: ModelInfo): boolean =>
  (info.layer_types ?? []).includes("linear_attention");

const hasIndexer = (info: ModelInfo): boolean =>
  (info.compress_ratios ?? []).includes(4);

const hasDraftModules = (info: ModelInfo): boolean =>
  Boolean(info.mtp_num_layers) ||
  (info.compress_ratios ?? []).length > (info.num_hidden_layers ?? 0);

const PrecisionSelect = ({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: KvCachePrecisionId | "";
  onChange: (value: KvCachePrecisionId) => void;
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <label
        className="text-xs text-muted-foreground"
        htmlFor={id}
        title={hint}
      >
        {label}
      </label>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as KvCachePrecisionId)}
      >
        <SelectTrigger id={id} className="mt-1" data-testid={id}>
          <SelectValue
            placeholder={t(
              "endpoints.kvCache.precisionPlaceholder",
              "Select a precision",
            )}
          />
        </SelectTrigger>
        <SelectContent>
          {KV_CACHE_PRECISIONS.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {t(`endpoints.kvCache.precisions.${option.id}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const Toggle = ({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <div className="flex items-center gap-2">
    <Switch
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      data-testid={id}
    />
    <label className="text-xs text-muted-foreground" htmlFor={id}>
      {label}
    </label>
  </div>
);

/**
 * One part of the cache: what it is, what it costs, and the product it came
 * from. The parts are listed rather than summed into one formula because they
 * do not scale alike — a windowed or recurrent part stops growing while a
 * token-linear one keeps going — and a single product would hide exactly that.
 */
const ComponentRow = ({
  component,
  totalBytes,
}: {
  component: KvCacheComponent;
  totalBytes: number;
}) => {
  const { t } = useTranslation();
  const share = totalBytes > 0 ? component.bytes / totalBytes : 0;

  return (
    <div
      className="border-t pt-3 first:border-t-0 first:pt-0"
      data-testid={`kv-cache-component-${component.key}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">
          {t(`endpoints.kvCache.components.${component.key}`)}
        </span>
        <span className="tabular-nums">
          {compactNumber.format(component.bytes / BYTES_PER_GB)} GB
        </span>
        <span className="text-muted-foreground">{percent.format(share)}</span>
        {component.perToken ? null : (
          <span className="text-muted-foreground">
            {t(
              "endpoints.kvCache.notPerToken",
              "does not grow with the sequence",
            )}
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {component.factors.map((factor, index) => (
          <span
            key={factor.key}
            className="inline-flex min-w-0 items-baseline gap-1.5 font-mono text-[11px]"
          >
            {index > 0 ? (
              <span className="text-muted-foreground">×</span>
            ) : null}
            <Factor factor={factor} />
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
          <span className="text-muted-foreground">÷</span>
          <span className="rounded-[var(--nt-radius-checkbox)] border bg-muted/35 px-1.5 py-1 font-medium tabular-nums">
            {groupedNumber.format(BYTES_PER_GB)}
          </span>
        </span>
      </div>
    </div>
  );
};

const factorValues = (factor: KvCacheFactor) =>
  factor.kind === "sum" || factor.kind === "min" ? factor.terms : [factor];

const Refusal = ({
  result,
}: {
  result: Extract<KvCacheResult, { ok: false }>;
}) => {
  const { t } = useTranslation();

  if (result.reason === "missing-fields") {
    const fields = result.missingFields
      .map((field) => t(`endpoints.kvCache.factors.${field}`))
      .join(", ");

    return (
      <>
        {t(
          "endpoints.kvCache.missingFields",
          "Cannot estimate: this checkpoint does not state {{fields}}.",
          { fields },
        )}
      </>
    );
  }

  if (result.reason === "layer-types") {
    return (
      <>
        {t(
          "endpoints.kvCache.layerTypes",
          "Cannot estimate: this checkpoint caches {{types}} layers differently from full attention, and these formulas describe one layer repeated.",
          { types: result.layerTypes.join(", ") },
        )}
      </>
    );
  }

  if (result.reason === "compression-rates") {
    return (
      <>
        {t(
          "endpoints.kvCache.compressionRates",
          "Cannot estimate: this checkpoint compresses at a rate ({{rates}}) whose cache layout has not been established from any released checkpoint, so whether those layers carry an indexer is unknown.",
          { rates: result.compressionRates.join(", ") },
        )}
      </>
    );
  }

  if (result.reason === "no-model-info") {
    return (
      <>
        {t(
          "endpoints.kvCache.noModelInfo",
          "Cannot estimate: nothing is known about this checkpoint.",
        )}
      </>
    );
  }

  return (
    <>
      {t(
        "endpoints.kvCache.invalidInput",
        "Enter a whole number of tokens and sequences, and pick a KV precision.",
      )}
    </>
  );
};

/**
 * What the registry said instead of a checkpoint. These are failures of the
 * read, not of the estimate, and each one has a different thing for the user to
 * do — supply credentials, pick another model, wait and retry — so they are
 * worded separately and never folded into the estimator's "this field is
 * missing".
 */
const ReadNotice = ({ read }: { read: NoticeRead }) => {
  const { t } = useTranslation();

  if (read.state === "loading") {
    return <>{t("endpoints.kvCache.reading", "Reading the checkpoint…")}</>;
  }

  if (read.state === "unreported") {
    return (
      <>
        {t(
          "endpoints.kvCache.unreported",
          "This registry reports nothing about the checkpoint, so there is nothing to compute from.",
        )}
      </>
    );
  }

  if (read.state === "unparsed") {
    return (
      <>
        {t(
          "endpoints.kvCache.unparsed",
          "The registry read this model and found no config.json it could parse, so its shape is unknown.",
        )}
      </>
    );
  }

  return (
    <>
      {t(`endpoints.kvCache.unread.${read.reason}`)}
      {read.message ? (
        <span className="mt-1 block text-xs opacity-80">{read.message}</span>
      ) : null}
    </>
  );
};

/** Every read state the panel has something to say about: not the estimate
 * itself, and not the state where no model is selected and it renders nothing. */
type NoticeRead = Exclude<
  ModelInfoRead,
  { state: "ready" } | { state: "none" }
>;

/** The panel's frame, so the notice and the estimate look like one thing. */
const Panel = ({ state, children }: { state: string; children: ReactNode }) => {
  const { t } = useTranslation();

  return (
    <div
      className="rounded-lg border bg-muted/20 p-3"
      data-testid="kv-cache-estimate"
      data-state={state}
    >
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        {t("endpoints.kvCache.title", "KV cache estimate")}
        <InfoHint label={t("endpoints.kvCache.titleHint")} />
      </div>
      {children}
    </div>
  );
};

/**
 * One of the two counts, as a field to fill in or as the value a control
 * elsewhere already holds.
 *
 * Read-only is not a lesser version: where the form has a control for this
 * quantity, that control is what the deployment will use, and offering a second
 * field beside it leaves a reader unable to tell which number applies. Naming
 * the owner is what keeps the read-only value actionable — said once, behind
 * an InfoHint rather than as a permanent line, so it does not repeat what the
 * SourceTag badge beside the label already shows at a glance.
 */
const CountField = ({
  id,
  label,
  field,
  value,
  ownedBy,
}: {
  id: string;
  label: string;
  field: { source: KvCacheSource; onChange: (next: string) => void };
  value: string;
  ownedBy: string | null;
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const showsSource = ["derived", "manual", "unstated", "deployment"].includes(
    field.source,
  );
  const sourceHint = showsSource
    ? t(`endpoints.kvCache.sourceHints.${field.source}`)
    : null;
  const ownerHint = ownedBy
    ? t("endpoints.kvCache.ownedBy", { control: ownedBy })
    : null;
  const hint = [sourceHint, ownerHint].filter(Boolean).join(" ");
  // Where to put the caret once this render's reformat lands — set in the
  // change handler, from the digit it followed rather than a character
  // index, and applied after the DOM has the new (possibly longer or
  // shorter) grouped string. A plain controlled value would otherwise leave
  // the caret wherever the browser's own edit put it, which is the wrong
  // place the moment a comma is inserted or removed ahead of it.
  const pendingCaret = useRef<number | null>(null);

  // No dependency array: this only ever has work to do on the render right
  // after the change handler set pendingCaret, and reading it there rather
  // than depending on `value` is what lets the ref (not a render input) be
  // the trigger — the caret fix is a side effect of that render, not of the
  // value that produced it.
  useLayoutEffect(() => {
    if (pendingCaret.current !== null) {
      inputRef.current?.setSelectionRange(
        pendingCaret.current,
        pendingCaret.current,
      );
      pendingCaret.current = null;
    }
  });

  if (ownedBy) {
    return (
      <div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {label}
          {hint && <InfoHint label={hint} />}
        </div>
        <div
          className="mt-1 flex h-9 items-center font-medium tabular-nums"
          data-testid={id}
          data-owned-by={ownedBy}
        >
          {value ? formatGroupedInput(value) : <EmptyValue />}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <label htmlFor={id}>{label}</label>
        {hint && <InfoHint label={hint} />}
      </div>
      <Input
        ref={inputRef}
        id={id}
        className="mt-1"
        inputMode="numeric"
        value={formatGroupedInput(value)}
        onChange={(event) => {
          const raw = stripGrouping(event.target.value);
          const caretDigits = digitsBefore(
            event.target.value,
            event.target.selectionStart ?? event.target.value.length,
          );

          pendingCaret.current = caretAfterDigits(
            formatGroupedInput(raw),
            caretDigits,
          );
          field.onChange(raw);
        }}
        data-testid={id}
      />
    </div>
  );
};

export const KVCacheEstimate = ({
  read,
  engineArgs = NO_ENGINE_CACHE_ARGS,
  controls = NO_ENGINE_CACHE_ARG_CONTROLS,
  stackFields = false,
  onEstimate,
  onStateChange,
}: {
  read: ModelInfoRead;
  /** What this deployment's engine args say about context and concurrency.
   * Absent on any path that has none, which falls back to the checkpoint. */
  engineArgs?: EngineCacheArgs;
  /**
   * Controls elsewhere on the form that own these quantities, by label.
   *
   * Where one exists the panel shows the value it holds instead of a field of
   * its own: two inputs for one number is an ambiguity, and a reader has no way
   * to tell which of them the deployment will use. Absent on a form that offers
   * no such control, where the field is the only place to say it — and is a
   * what-if the deployment does not follow.
   */
  controls?: EngineCacheArgControls;
  /** The estimator is often placed in a narrow persistent rail. Stacking its
   * fields keeps them readable instead of squeezing three columns into it. */
  stackFields?: boolean;
  /**
   * Reports the panel's current total (in GB), or null while it cannot compute
   * one — a caller combining this with a declared weights figure needs the
   * number, not just the rendering of it. Fires on every recompute, including
   * unmount (via the effect cleanup path a caller may wire up), so a stale
   * total never lingers once this panel stops mounting.
   */
  onEstimate?: (gb: number | null) => void;
  onStateChange?: (state: KVCacheEstimateState) => void;
}) => {
  useEffect(() => {
    if (read.state !== "ready") {
      onEstimate?.(null);
    }
    // Only the non-ready paths are handled here — the ready path's total comes
    // from the Estimator itself, which knows the actual computed result.
  }, [read.state, onEstimate]);

  useEffect(() => {
    if (read.state === "ready" || read.state === "none") return;
    onStateChange?.({
      kind: "unavailable",
      reason: read.state === "unread" ? `unread-${read.reason}` : read.state,
    });
  }, [onStateChange, read]);

  if (read.state === "none") {
    return null;
  }

  if (read.state !== "ready") {
    return (
      <Panel
        state={read.state === "unread" ? `unread-${read.reason}` : read.state}
      >
        <div
          className="text-sm text-muted-foreground"
          data-testid="kv-cache-notice"
        >
          <ReadNotice read={read} />
        </div>
      </Panel>
    );
  }

  return (
    <Estimator
      info={read.info}
      engineArgs={engineArgs}
      controls={controls}
      stackFields={stackFields}
      onEstimate={onEstimate}
      onStateChange={onStateChange}
    />
  );
};

/**
 * A number field that starts from what the deployment says and follows it until
 * the user types in it.
 *
 * The default has to be able to move: a recipe's context window is chosen by a
 * feature the user can switch, so a value derived once at mount goes stale the
 * moment they change it, and a panel showing a stale figure next to the control
 * that changed it is worse than one that never offered a default.
 *
 * It must equally not move *back*. Once someone has typed a number here they
 * are asking a what-if — "how much would 128k cost?" — and having the answer
 * overwritten by an unrelated feature toggle destroys an input they cannot get
 * back, with nothing on screen to say why. So the field stops following on the
 * first edit and the user owns it from there.
 *
 * The boundary is per field, not per panel: changing the concurrency must not
 * freeze the context length. It resets when the panel remounts, which happens
 * per selected model — a different checkpoint is a different question, and the
 * old answer was about the old model.
 *
 * `derived` is the value to follow, or null when nothing states one; `source`
 * is where that value came from, and becomes "input" once the field is the
 * user's.
 */
function useDeploymentDefault(
  derived: number | null,
  derivedSource: KvCacheSource,
): {
  value: string;
  source: KvCacheSource;
  onChange: (next: string) => void;
} {
  const [value, setValue] = useState(() =>
    derived === null ? "" : String(derived),
  );
  const edited = useRef(false);

  useEffect(() => {
    if (edited.current || derived === null) {
      return;
    }

    setValue(String(derived));
  }, [derived]);

  return {
    value,
    source: edited.current ? "input" : derivedSource,
    onChange: (next: string) => {
      edited.current = true;
      setValue(next);
    },
  };
}

/**
 * The calculator itself, mounted only once the checkpoint has been read: its
 * inputs take their defaults from that checkpoint, and a component mounted
 * while the read was still in flight would have defaulted from nothing.
 */
const Estimator = ({
  info,
  engineArgs,
  controls,
  stackFields,
  onEstimate,
  onStateChange,
}: {
  info: ModelInfo;
  engineArgs: EngineCacheArgs;
  controls: EngineCacheArgControls;
  stackFields: boolean;
  onEstimate?: (gb: number | null) => void;
  onStateChange?: (state: KVCacheEstimateState) => void;
}) => {
  const { t } = useTranslation();

  // Where the two counts start from, in order of what they are about. The
  // engine args are what this deployment will actually be created with; the
  // checkpoint's context length is only a ceiling, and on a model like
  // Qwen3.6-27B the two are eight-fold apart. Someone filling in this form is
  // sizing the deployment, so the deployment answers first.
  //
  // An unstated context length leaves the field empty rather than inventing
  // one, because a token count invented here would end up multiplied into a
  // number presented as an estimate of their deployment. Concurrency does have
  // a floor worth defaulting to: one sequence is the smallest deployment that
  // exists, and it is visibly a starting point rather than a claim.
  const derivedTokens =
    engineArgs.maxModelLen ?? info.max_position_embeddings ?? null;
  const tokensField = useDeploymentDefault(
    derivedTokens,
    engineArgs.maxModelLen !== null
      ? "deployment"
      : (modelFieldSource(info, "max_position_embeddings") ?? "auto"),
  );
  const sequencesField = useDeploymentDefault(
    engineArgs.maxNumSeqs ?? 1,
    engineArgs.maxNumSeqs !== null ? "deployment" : "input",
  );
  const tokens = tokensField.value;
  const sequences = sequencesField.value;

  const [precision, setPrecision] = useState<KvCachePrecisionId | "">(
    () => defaultPrecisionId(info) ?? "",
  );

  // The three service-policy inputs below are not properties of the checkpoint.
  // How wide the recurrent state and the indexer are held, and how many
  // recurrent states a sequence retains, are decisions an engine makes; their
  // defaults match what current serving implementations do, and the user owns
  // them from there. They are only offered where the checkpoint says they
  // apply, so an ordinary GQA model shows the three inputs it always did.
  const [recurrentPrecision, setRecurrentPrecision] = useState<
    KvCachePrecisionId | ""
  >(() => defaultRecurrentStatePrecisionId(info) ?? "");
  const [indexerPrecision, setIndexerPrecision] = useState<
    KvCachePrecisionId | ""
  >(DEFAULT_INDEXER_PRECISION);
  const [checkpointInterval, setCheckpointInterval] = useState("");
  const [includeLinearState, setIncludeLinearState] = useState(true);
  const [includeDraftKvCache, setIncludeDraftKvCache] = useState(false);
  const [showFormula, setShowFormula] = useState(false);

  const linear = hasLinearAttention(info);
  const indexes = hasIndexer(info);
  const drafts = hasDraftModules(info);

  const checkpointPolicy: LinearStateCheckpointPolicy =
    checkpointInterval.trim() === ""
      ? { kind: "prompt-end" }
      : { kind: "fixed-interval", tokens: parseCount(checkpointInterval) };

  const result = estimateKvCache({
    info,
    tokensPerSequence: parseCount(tokens),
    sequences: parseCount(sequences),
    tokensSource: tokensField.source,
    sequencesSource: sequencesField.source,
    bytesPerElement: bytesOf(precision),
    recurrentStateBytesPerElement: bytesOf(recurrentPrecision),
    indexerBytesPerElement: bytesOf(indexerPrecision),
    checkpointPolicy,
    includeLinearState,
    includeDraftKvCache,
  });
  const unreportedFactorKeys = result.ok
    ? Array.from(
        new Set(
          result.components
            .flatMap((component) => component.factors.flatMap(factorValues))
            .filter((factor) => factor.source === "unstated")
            .map((factor) => factor.key),
        ),
      ).sort()
    : [];
  const unreportedFactorLabels = unreportedFactorKeys
    .map((key) => t(`endpoints.kvCache.factors.${key}`))
    .join(", ");

  const resultGb = result.ok ? result.totalGb : null;
  useEffect(() => {
    onEstimate?.(resultGb);
  }, [resultGb, onEstimate]);
  useEffect(() => {
    onStateChange?.(
      result.ok
        ? {
            kind: "ready",
            totalGb: result.totalGb,
            tokensPerSequence: parseCount(tokens),
            sequences: parseCount(sequences),
            precision,
            family: result.family,
          }
        : {
            kind: "unavailable",
            reason: result.reason,
            missingFields: result.missingFields,
          },
    );
  }, [onStateChange, precision, result, sequences, tokens]);

  // Missing checkpoint architecture cannot be repaired through these inputs:
  // offering them beside a refusal makes the panel look broken and invites the
  // reader to keep changing values that cannot affect the answer.
  const inputsAffectResult = result.ok || result.reason === "invalid-input";

  return (
    <Panel state={result.ok ? result.family : result.reason}>
      {inputsAffectResult && (
        <div
          className={
            stackFields
              ? "grid grid-cols-2 gap-3 [&>*:last-child]:col-span-2"
              : "grid grid-cols-1 gap-3 sm:grid-cols-3"
          }
        >
          <CountField
            id="kv-cache-tokens"
            label={t(
              "endpoints.kvCache.tokensPerSequence",
              "Tokens per sequence",
            )}
            field={tokensField}
            value={tokens}
            ownedBy={controls.context}
          />
          <CountField
            id="kv-cache-sequences"
            label={t("endpoints.kvCache.sequences", "Concurrent sequences")}
            field={sequencesField}
            value={sequences}
            ownedBy={controls.concurrency}
          />
          <div>
            <label
              className="text-xs text-muted-foreground"
              htmlFor="kv-cache-precision"
            >
              {t("endpoints.kvCache.precision", "KV precision")}
            </label>
            <Select
              value={precision}
              onValueChange={(value) =>
                setPrecision(value as KvCachePrecisionId)
              }
            >
              <SelectTrigger
                id="kv-cache-precision"
                className="mt-1"
                data-testid="kv-cache-precision"
              >
                <SelectValue
                  placeholder={t(
                    "endpoints.kvCache.precisionPlaceholder",
                    "Select a precision",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {KV_CACHE_PRECISIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {t(`endpoints.kvCache.precisions.${option.id}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {inputsAffectResult && (linear || indexes || drafts) ? (
        <div
          className={
            stackFields
              ? "mt-3 grid grid-cols-1 gap-3"
              : "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"
          }
          data-testid="kv-cache-policy-inputs"
        >
          {linear ? (
            <PrecisionSelect
              id="kv-cache-recurrent-precision"
              label={t(
                "endpoints.kvCache.recurrentPrecision",
                "Recurrent state precision",
              )}
              hint={t(
                "endpoints.kvCache.recurrentPrecisionHint",
                "Linear-attention state is held at this width. Its short-convolution history stays BF16.",
              )}
              value={recurrentPrecision}
              onChange={setRecurrentPrecision}
            />
          ) : null}
          {indexes ? (
            <PrecisionSelect
              id="kv-cache-indexer-precision"
              label={t(
                "endpoints.kvCache.indexerPrecision",
                "Indexer precision",
              )}
              hint={t(
                "endpoints.kvCache.indexerPrecisionHint",
                "Sparse-attention indexer entries are held separately from the KV cache.",
              )}
              value={indexerPrecision}
              onChange={setIndexerPrecision}
            />
          ) : null}
          {linear ? (
            <div>
              <label
                className="text-xs text-muted-foreground"
                htmlFor="kv-cache-checkpoint-interval"
              >
                {t(
                  "endpoints.kvCache.checkpointInterval",
                  "Recurrent state interval",
                )}
              </label>
              <Input
                id="kv-cache-checkpoint-interval"
                className="mt-1"
                inputMode="numeric"
                placeholder={t(
                  "endpoints.kvCache.checkpointIntervalPlaceholder",
                  "Prompt end only",
                )}
                value={checkpointInterval}
                onChange={(event) => setCheckpointInterval(event.target.value)}
                data-testid="kv-cache-checkpoint-interval"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {inputsAffectResult && (linear || drafts) ? (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {linear ? (
            <Toggle
              id="kv-cache-include-linear-state"
              label={t(
                "endpoints.kvCache.includeLinearState",
                "Retain linear-attention state",
              )}
              checked={includeLinearState}
              onChange={setIncludeLinearState}
            />
          ) : null}
          {drafts ? (
            <Toggle
              id="kv-cache-include-draft"
              label={t(
                "endpoints.kvCache.includeDraftKvCache",
                "Include draft (MTP) KV",
              )}
              checked={includeDraftKvCache}
              onChange={setIncludeDraftKvCache}
            />
          ) : null}
        </div>
      ) : null}

      {result.ok ? (
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-lg font-semibold tabular-nums">
              ≈ {compactNumber.format(result.totalGb)} GB
            </span>
            <span className="text-xs text-muted-foreground">
              {t(
                result.uniformlyPerToken
                  ? "endpoints.kvCache.bytesPerToken"
                  : "endpoints.kvCache.averageBytesPerToken",
                { bytes: groupedNumber.format(result.bytesPerToken) },
              )}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {t(`endpoints.kvCache.families.${result.family}`)}
              {/* Which formula was used and what statement in the checkpoint
                  settled it. More than one layout can be reached from a
                  checkpoint that also states the head fields, and the number
                  alone does not say which was taken — so the basis is still
                  said, just behind a hint rather than as a permanent line,
                  the same treatment every other explanatory line on this form
                  gets. */}
              <InfoHint
                label={t(`endpoints.kvCache.familyBasis.${result.familyBasis}`)}
              />
            </span>
          </div>
          <Dialog open={showFormula} onOpenChange={setShowFormula}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-xs font-normal text-muted-foreground hover:bg-transparent"
                data-testid="kv-cache-formula-toggle"
              >
                {t("endpoints.kvCache.showFormula")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
              <DialogHeader>
                <DialogTitle>{t("endpoints.kvCache.formulaTitle")}</DialogTitle>
                <DialogDescription>
                  {t("endpoints.kvCache.formulaDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 overflow-y-auto pr-1">
                {unreportedFactorKeys.length > 0 && (
                  <div
                    className="mb-4 rounded-md bg-muted/50 px-3 py-2.5 text-xs"
                    data-testid="kv-cache-unreported-sources"
                  >
                    <p className="text-foreground">
                      {t("endpoints.kvCache.sourceUnreported", {
                        count: unreportedFactorKeys.length,
                        fields: unreportedFactorLabels,
                      })}
                    </p>
                  </div>
                )}
                <div
                  className="grid gap-4 text-xs"
                  data-testid="kv-cache-components"
                >
                  {result.components.map((component) => (
                    <ComponentRow
                      key={component.key}
                      component={component}
                      totalBytes={result.totalBytes}
                    />
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div
          className="mt-3 text-sm text-muted-foreground"
          data-testid="kv-cache-refusal"
        >
          <Refusal result={result} />
        </div>
      )}
    </Panel>
  );
};
