import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingIcon } from "@/components/ui/loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateRegistryModel } from "@/domains/model-registry/hooks/use-registry-model";
import type {
  PatchRegistryModelBody,
  RegistryModelRef,
} from "@/foundation/lib/api/registry-models";
import { RegistryModelError } from "@/foundation/lib/api/registry-models";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ModelAliasConflict } from "@/foundation/types/model-types";
import { modelFieldSource } from "@/foundation/types/model-types";
import type { ModelInfo } from "@/foundation/types/serving-types";

/**
 * Edits the two things about a model a user owns: its display alias and the
 * info fields they fill in by hand.
 *
 * Only hand-filled values are loaded into the form. A value the server parsed
 * out of the checkpoint stays out of it — echoing it back would have the server
 * record it as hand-filled, turning a measured value into a claimed one for no
 * reason other than that the dialog was opened. Parsed values are shown as
 * placeholders instead, which is context rather than input.
 */

type TextFieldKey =
  | "parameter_count"
  | "architecture"
  | "parameter_dtype"
  | "quantization"
  | "context_length";

type NumberFieldKey =
  | "quantization_bits"
  | "max_position_embeddings"
  | "num_hidden_layers"
  | "num_attention_heads"
  | "num_key_value_heads"
  | "head_dim"
  | "num_experts"
  | "num_experts_per_token";

const TEXT_FIELDS: { key: TextFieldKey; labelKey: string }[] = [
  { key: "parameter_count", labelKey: "parameterCount" },
  { key: "architecture", labelKey: "architecture" },
  { key: "parameter_dtype", labelKey: "parameterDtype" },
  { key: "quantization", labelKey: "quantization" },
  { key: "context_length", labelKey: "contextLength" },
];

const NUMBER_FIELDS: { key: NumberFieldKey; labelKey: string }[] = [
  { key: "quantization_bits", labelKey: "quantizationBits" },
  { key: "max_position_embeddings", labelKey: "maxPositionEmbeddings" },
  { key: "num_hidden_layers", labelKey: "numHiddenLayers" },
  { key: "num_attention_heads", labelKey: "numAttentionHeads" },
  { key: "num_key_value_heads", labelKey: "numKeyValueHeads" },
  { key: "head_dim", labelKey: "headDim" },
  { key: "num_experts", labelKey: "numExperts" },
  { key: "num_experts_per_token", labelKey: "numExpertsPerToken" },
];

const MOE_UNSET = "unset";

type FormState = {
  alias: string;
  fields: Record<string, string>;
  isMoe: string;
};

/** Loads the form from the values the server attributes to a person. */
const initialState = (info: ModelInfo | null | undefined): FormState => {
  const fields: Record<string, string> = {};

  for (const { key } of [...TEXT_FIELDS, ...NUMBER_FIELDS]) {
    const value = info?.[key];

    if (modelFieldSource(info, key) === "manual" && value != null) {
      fields[key] = String(value);
    } else {
      fields[key] = "";
    }
  }

  const isMoe =
    modelFieldSource(info, "is_moe") === "manual" && info?.is_moe != null
      ? String(info.is_moe)
      : MOE_UNSET;

  return { alias: "", fields, isMoe };
};

/** What the current value of a field is, whoever established it — shown as a
 * placeholder so the user can see what they would be overriding. */
const effectiveValue = (
  info: ModelInfo | null | undefined,
  key: TextFieldKey | NumberFieldKey,
): string => {
  const value = info?.[key];

  return value == null || value === "" ? "" : String(value);
};

const buildInfo = (state: FormState): ModelInfo => {
  const info: ModelInfo = {};

  for (const { key } of TEXT_FIELDS) {
    const value = state.fields[key]?.trim();

    if (value) {
      info[key] = value;
    }
  }

  for (const { key } of NUMBER_FIELDS) {
    const value = state.fields[key]?.trim();

    if (value && !Number.isNaN(Number(value))) {
      info[key] = Number(value);
    }
  }

  if (state.isMoe !== MOE_UNSET) {
    info.is_moe = state.isMoe === "true";
  }

  return info;
};

const sameInfo = (a: ModelInfo, b: ModelInfo) =>
  JSON.stringify(a) === JSON.stringify(b);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelRef: RegistryModelRef;
  /** The physical model name, which this dialog never changes. */
  modelName: string;
  alias?: string;
  info?: ModelInfo | null;
};

export const ModelEditDialog = ({
  open,
  onOpenChange,
  modelRef,
  modelName,
  alias,
  info,
}: Props) => {
  const { t } = useTranslation();
  const update = useUpdateRegistryModel();

  const baseline = useMemo(() => initialState(info), [info]);
  const [state, setState] = useState<FormState>(() => ({
    ...baseline,
    alias: alias ?? "",
  }));
  const [conflict, setConflict] = useState<ModelAliasConflict | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // Remounting on open is what keeps the form in step with a model that was
  // edited elsewhere since this dialog was last closed.
  const reset = (nextOpen: boolean) => {
    if (nextOpen) {
      setState({ ...initialState(info), alias: alias ?? "" });
      setConflict(null);
      setFailure(null);
    }

    onOpenChange(nextOpen);
  };

  const setField = (key: string, value: string) =>
    setState((current) => ({
      ...current,
      fields: { ...current.fields, [key]: value },
    }));

  const submit = () => {
    const body: PatchRegistryModelBody = {};
    const nextInfo = buildInfo(state);
    const currentAlias = alias ?? "";

    if (state.alias.trim() !== currentAlias) {
      body.alias = state.alias.trim();
    }

    if (!sameInfo(nextInfo, buildInfo(baseline))) {
      body.info = nextInfo;
    }

    if (Object.keys(body).length === 0) {
      reset(false);

      return;
    }

    setConflict(null);
    setFailure(null);

    update.mutate(
      { ref: modelRef, body },
      {
        onSuccess: () => {
          toast.success(t("model_registries.models.edit.success"));
          reset(false);
        },
        onError: (error) => {
          // A taken alias is reported where the alias is typed, naming what it
          // collided with. A toast would take the answer away from the field
          // the user has to change.
          if (
            error instanceof RegistryModelError &&
            error.status === 409 &&
            error.body.conflict
          ) {
            setConflict(error.body.conflict);

            return;
          }

          setFailure(error.message);
        },
      },
    );
  };

  const conflictMessage = (value: ModelAliasConflict) =>
    value.version
      ? t("model_registries.models.edit.conflictModel", {
          name: value.name,
          version: value.version,
        })
      : t("model_registries.models.edit.conflictModelName", {
          name: value.name,
        });

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("model_registries.models.edit.title")}</DialogTitle>
          <DialogDescription>
            {t("model_registries.models.edit.description", {
              name: modelName,
              version: modelRef.version ?? "",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="model-alias">
              {t("model_registries.models.fields.alias")}
            </Label>
            <Input
              id="model-alias"
              data-testid="model-alias-input"
              value={state.alias}
              placeholder={t("model_registries.models.edit.aliasPlaceholder")}
              onChange={(event) => {
                setConflict(null);
                setState((current) => ({
                  ...current,
                  alias: event.target.value,
                }));
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t("model_registries.models.edit.aliasHint")}
            </p>
            {conflict ? (
              <p
                className="text-sm text-destructive"
                data-testid="model-alias-conflict"
              >
                {conflictMessage(conflict)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>{t("model_registries.models.edit.manualSection")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("model_registries.models.edit.manualHint")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TEXT_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label
                    htmlFor={`model-info-${field.key}`}
                    className="text-xs font-normal text-muted-foreground"
                  >
                    {t(
                      `model_registries.models.fields.${field.labelKey}`,
                    )}
                  </Label>
                  <Input
                    id={`model-info-${field.key}`}
                    value={state.fields[field.key] ?? ""}
                    placeholder={effectiveValue(info, field.key)}
                    onChange={(event) =>
                      setField(field.key, event.target.value)
                    }
                  />
                </div>
              ))}
              {NUMBER_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label
                    htmlFor={`model-info-${field.key}`}
                    className="text-xs font-normal text-muted-foreground"
                  >
                    {t(
                      `model_registries.models.fields.${field.labelKey}`,
                    )}
                  </Label>
                  <Input
                    id={`model-info-${field.key}`}
                    type="number"
                    value={state.fields[field.key] ?? ""}
                    placeholder={effectiveValue(info, field.key)}
                    onChange={(event) =>
                      setField(field.key, event.target.value)
                    }
                  />
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs font-normal text-muted-foreground">
                  {t("model_registries.models.fields.isMoe")}
                </Label>
                <Select
                  value={state.isMoe}
                  onValueChange={(value) =>
                    setState((current) => ({ ...current, isMoe: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MOE_UNSET}>
                      {t("model_registries.models.edit.unset")}
                    </SelectItem>
                    <SelectItem value="true">
                      {t("model_registries.models.values.yes")}
                    </SelectItem>
                    <SelectItem value="false">
                      {t("model_registries.models.values.no")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {failure ? (
            <p className="text-sm text-destructive" data-testid="model-edit-error">
              {failure}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => reset(false)}>
            {t("buttons.cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={update.isLoading}
            data-testid="model-edit-submit"
          >
            {update.isLoading ? <LoadingIcon className="mr-2" /> : null}
            {t("buttons.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
