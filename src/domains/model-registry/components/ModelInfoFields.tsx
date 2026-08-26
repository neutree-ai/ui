import { UserRound } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import {
  isModelFieldMissing,
  type ModelFieldSource,
  modelFieldSource,
} from "@/foundation/types/model-types";
import type { ModelInfo } from "@/foundation/types/serving-types";

/**
 * The model info fields, each shown with where its value came from.
 *
 * Nothing here fills a gap. A field the server did not establish is rendered as
 * unknown, never as a zero, a dash-that-means-zero or a value guessed from the
 * model's name: the whole point of the server reporting provenance is that a
 * reader can tell a measured value from an absent one, and a default would
 * erase that distinction the moment it is displayed.
 */

type FieldKind = "text" | "integer" | "boolean";

/** The value-carrying fields; the two provenance lists are not among them. */
type FieldKey = Exclude<keyof ModelInfo, "field_sources" | "missing_fields">;

type FieldDescriptor = {
  /** The field's JSON name — also its key in field_sources / missing_fields. */
  key: FieldKey;
  labelKey: string;
  kind: FieldKind;
};

const FIELDS: FieldDescriptor[] = [
  { key: "parameter_count", labelKey: "parameterCount", kind: "text" },
  { key: "architecture", labelKey: "architecture", kind: "text" },
  { key: "parameter_dtype", labelKey: "parameterDtype", kind: "text" },
  { key: "quantization", labelKey: "quantization", kind: "text" },
  { key: "quantization_bits", labelKey: "quantizationBits", kind: "integer" },
  { key: "context_length", labelKey: "contextLength", kind: "text" },
  {
    key: "max_position_embeddings",
    labelKey: "maxPositionEmbeddings",
    kind: "integer",
  },
  { key: "num_hidden_layers", labelKey: "numHiddenLayers", kind: "integer" },
  {
    key: "num_attention_heads",
    labelKey: "numAttentionHeads",
    kind: "integer",
  },
  { key: "num_key_value_heads", labelKey: "numKeyValueHeads", kind: "integer" },
  { key: "head_dim", labelKey: "headDim", kind: "integer" },
  { key: "is_moe", labelKey: "isMoe", kind: "boolean" },
  { key: "num_experts", labelKey: "numExperts", kind: "integer" },
  {
    key: "num_experts_per_token",
    labelKey: "numExpertsPerToken",
    kind: "integer",
  },
];

const groupedNumber = new Intl.NumberFormat("en");

/** Digit strings get thousands separators so a parameter count is readable;
 * anything else is passed through untouched, because a hand-written value like
 * "72.7B" is the user's wording and not ours to reformat. */
const formatTextValue = (value: string): string =>
  /^\d+$/.test(value) ? groupedNumber.format(Number(value)) : value;

type ValueState =
  | { state: "value"; text: string }
  | { state: "unknown" | "notApplicable" };

/**
 * Decides what a field says, from the value and the two lists beside it.
 *
 * The server distinguishes three outcomes and so does this: a value it
 * established, a field it looked for and could not establish (named in
 * missing_fields), and a field that does not apply to this model at all — an
 * expert count on a dense checkpoint — which it leaves out of both. Only a
 * response that states no provenance at all (a hand-written catalog) collapses
 * the last two into unknown, because there it really is unknown.
 */
export const resolveFieldValue = (
  info: ModelInfo,
  field: FieldDescriptor,
): ValueState => {
  const raw = info[field.key];

  // `false` and `0` are values. Only undefined, null and the empty string mean
  // the server sent nothing — which is why the structured fields are optional
  // rather than zero-valued on the wire.
  if (raw !== undefined && raw !== null && raw !== "") {
    if (field.kind === "boolean") {
      return { state: "value", text: raw === true ? "true" : "false" };
    }

    if (field.kind === "integer") {
      return { state: "value", text: groupedNumber.format(Number(raw)) };
    }

    return { state: "value", text: formatTextValue(String(raw)) };
  }

  if (isModelFieldMissing(info, field.key)) {
    return { state: "unknown" };
  }

  const statesProvenance =
    info.missing_fields !== undefined || info.field_sources !== undefined;

  return statesProvenance ? { state: "notApplicable" } : { state: "unknown" };
};

const FieldValue = ({
  field,
  text,
}: {
  field: FieldDescriptor;
  text: string;
}) => {
  const { t } = useTranslation();

  if (field.kind !== "boolean") {
    return <>{text}</>;
  }

  return (
    <>
      {t(
        text === "true"
          ? "model_registries.models.values.yes"
          : "model_registries.models.values.no",
      )}
    </>
  );
};

const SourceTag = ({ source }: { source: ModelFieldSource | null }) => {
  const { t } = useTranslation();

  // "auto" is the unremarkable case — the value came out of the checkpoint, so
  // marking it would only add noise to every row.
  if (source !== "manual" && source !== "derived") {
    return null;
  }

  const label = t(`model_registries.models.sources.${source}`);
  const hint = t(`model_registries.models.sourceHints.${source}`);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="ml-1 inline-flex shrink-0 cursor-help align-middle text-muted-foreground"
            role="img"
            aria-label={label}
          >
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {label}: {hint}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const ModelInfoFields = ({
  info,
  className,
  variant = "grid",
}: {
  info?: ModelInfo | null;
  className?: string;
  variant?: "grid" | "definition-table";
}) => {
  const { t } = useTranslation();
  const resolved = info ?? {};

  return (
    <div
      className={cn(
        "grid grid-cols-1",
        variant === "grid" ? "gap-5 lg:grid-cols-4" : "gap-x-6 sm:grid-cols-2",
        className,
      )}
      data-testid="model-info-fields"
    >
      {FIELDS.map((field) => {
        const value = resolveFieldValue(resolved, field);
        const source = modelFieldSource(resolved, field.key);

        if (variant === "definition-table" && value.state === "notApplicable") {
          return null;
        }

        return (
          <div
            key={field.key}
            data-testid={`model-info-${field.key}`}
            className={cn(
              variant === "definition-table" &&
                "grid min-w-0 grid-cols-[minmax(7rem,42%)_minmax(0,1fr)] items-baseline border-b py-2 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0",
            )}
          >
            <div className="flex min-w-0 items-center text-xs font-medium leading-5 text-muted-foreground">
              {t(`model_registries.models.fields.${field.labelKey}`)}
              <SourceTag source={source} />
            </div>
            <div
              className={cn(
                "break-all text-sm leading-6",
                variant === "grid" && "mt-1",
              )}
            >
              {value.state === "value" ? (
                <FieldValue field={field} text={value.text} />
              ) : (
                <span
                  className={cn(
                    value.state === "unknown"
                      ? "text-[var(--nt-text-neutral-quaternary)]"
                      : "text-muted-foreground",
                  )}
                >
                  {t(`model_registries.models.values.${value.state}`)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
