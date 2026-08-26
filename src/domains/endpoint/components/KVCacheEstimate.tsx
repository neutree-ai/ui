import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import type { ModelInfo } from "@/foundation/types/serving-types";

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

  const value = Number(trimmed);

  return Number.isFinite(value) ? value : null;
};

const groupedNumber = new Intl.NumberFormat("en");
const compactNumber = new Intl.NumberFormat("en", {
  maximumSignificantDigits: 3,
});
const percent = new Intl.NumberFormat("en", {
  style: "percent",
  maximumFractionDigits: 0,
});

const bytesOf = (id: KvCachePrecisionId | ""): number | null =>
  KV_CACHE_PRECISIONS.find((precision) => precision.id === id)?.bytes ?? null;

/** Provenance worth marking. "auto" is the ordinary case and "input" is visibly
 * the user's own entry; tagging either would only add noise to every factor. */
const SourceTag = ({ source }: { source: KvCacheSource }) => {
  const { t } = useTranslation();

  if (source !== "derived" && source !== "manual" && source !== "unstated") {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className="ml-1 px-1 py-0 text-[10px] font-normal"
      title={t(`endpoints.kvCache.sourceHints.${source}`)}
    >
      {t(`endpoints.kvCache.sources.${source}`)}
    </Badge>
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

  return (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">
        {t(`endpoints.kvCache.factors.${factorKey}`)}
      </span>{" "}
      <span className="font-medium tabular-nums">
        {groupedNumber.format(value)}
      </span>
      <SourceTag source={source} />
    </span>
  );
};

const Factor = ({ factor }: { factor: KvCacheFactor }) => {
  const { t } = useTranslation();

  if (factor.kind === "sum" || factor.kind === "min") {
    return (
      <span className="whitespace-nowrap">
        {factor.kind === "min" ? "min" : null}
        {"("}
        {factor.terms.map((term, index) => (
          <span key={term.key}>
            {index > 0 ? (
              <span className="mx-1">{factor.kind === "min" ? "," : "+"}</span>
            ) : null}
            <FactorTerm
              factorKey={term.key}
              value={term.value}
              source={term.source}
            />
          </span>
        ))}
        {")"}{" "}
        <span className="text-muted-foreground">
          = {groupedNumber.format(factor.value)}
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
      className="rounded border border-transparent px-1 py-0.5 hover:border-border"
      data-testid={`kv-cache-component-${component.key}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
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
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {component.factors.map((factor, index) => (
          <span key={factor.key} className="flex items-center gap-2">
            {index > 0 ? (
              <span className="text-muted-foreground">×</span>
            ) : null}
            <Factor factor={factor} />
          </span>
        ))}
        <span className="text-muted-foreground">
          ÷ {groupedNumber.format(BYTES_PER_GB)}
        </span>
      </div>
    </div>
  );
};

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
      <div className="mb-2 text-sm font-medium">
        {t("endpoints.kvCache.title", "KV cache estimate")}
      </div>
      {children}
    </div>
  );
};

export const KVCacheEstimate = ({ read }: { read: ModelInfoRead }) => {
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

  return <Estimator info={read.info} />;
};

/**
 * The calculator itself, mounted only once the checkpoint has been read: its
 * inputs take their defaults from that checkpoint, and a component mounted
 * while the read was still in flight would have defaulted from nothing.
 */
const Estimator = ({ info }: { info: ModelInfo }) => {
  const { t } = useTranslation();

  // The context window the checkpoint states is a starting point for the one
  // input a user is most likely to change; an unstated one leaves the field
  // empty, because a token count invented here would end up multiplied into a
  // number presented as an estimate of their deployment.
  const [tokens, setTokens] = useState(() =>
    info.max_position_embeddings ? String(info.max_position_embeddings) : "",
  );
  const [sequences, setSequences] = useState("1");
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
    bytesPerElement: bytesOf(precision),
    recurrentStateBytesPerElement: bytesOf(recurrentPrecision),
    indexerBytesPerElement: bytesOf(indexerPrecision),
    checkpointPolicy,
    includeLinearState,
    includeDraftKvCache,
  });

  return (
    <Panel state={result.ok ? result.family : result.reason}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label
            className="text-xs text-muted-foreground"
            htmlFor="kv-cache-tokens"
          >
            {t("endpoints.kvCache.tokensPerSequence", "Tokens per sequence")}
          </label>
          <Input
            id="kv-cache-tokens"
            className="mt-1"
            inputMode="numeric"
            value={tokens}
            onChange={(event) => setTokens(event.target.value)}
            data-testid="kv-cache-tokens"
          />
        </div>
        <div>
          <label
            className="text-xs text-muted-foreground"
            htmlFor="kv-cache-sequences"
          >
            {t("endpoints.kvCache.sequences", "Concurrent sequences")}
          </label>
          <Input
            id="kv-cache-sequences"
            className="mt-1"
            inputMode="numeric"
            value={sequences}
            onChange={(event) => setSequences(event.target.value)}
            data-testid="kv-cache-sequences"
          />
        </div>
        <div>
          <label
            className="text-xs text-muted-foreground"
            htmlFor="kv-cache-precision"
          >
            {t("endpoints.kvCache.precision", "KV precision")}
          </label>
          <Select
            value={precision}
            onValueChange={(value) => setPrecision(value as KvCachePrecisionId)}
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

      {linear || indexes || drafts ? (
        <div
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"
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

      {linear || drafts ? (
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
            <span className="text-xs text-muted-foreground">
              {t(`endpoints.kvCache.families.${result.family}`)}
            </span>
          </div>
          {/* Which formula was used and what statement in the checkpoint
              settled it. More than one layout can be reached from a checkpoint
              that also states the head fields, and the number alone does not
              say which was taken — so the basis is stated rather than assumed
              to be obvious. */}
          <div className="text-xs text-muted-foreground">
            {t(`endpoints.kvCache.familyBasis.${result.familyBasis}`)}
          </div>
          <div className="space-y-1" data-testid="kv-cache-components">
            {result.components.map((component) => (
              <ComponentRow
                key={component.key}
                component={component}
                totalBytes={result.totalBytes}
              />
            ))}
          </div>
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
