import { useForm } from "@refinedev/react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import TestConnectionButton from "@/domains/log-sink/components/TestConnectionButton";
import { useLogSinkTestConnection } from "@/domains/log-sink/hooks/use-log-sink-test-connection";
import {
  emptyLogSinkFormValues,
  LOG_SINK_ERROR_FIELDS,
  type LogSinkFormValues,
  NAME_PATTERN,
  toLogSinkFormValues,
  toLogSinkPayload,
  validateBufferGib,
  validateExtraFieldKey,
  validateExtraFieldValue,
  validateSinkUrl,
  validateTimeoutSeconds,
} from "@/domains/log-sink/lib/log-sink-form";
import type { LogSink } from "@/domains/log-sink/types";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { FormSelect } from "@/foundation/components/FormSelect";
import { useRefineFieldArray } from "@/foundation/hooks/use-refine-field-array";
import { useTranslation } from "@/foundation/lib/i18n";

// Every field and rule here traces to src/domains/log-sink/data.md.
export const useLogSinkForm = ({ action }: { action: "create" | "edit" }) => {
  const { t } = useTranslation();
  const isEdit = action === "edit";

  const form = useForm<LogSink>({
    mode: "all",
    defaultValues: emptyLogSinkFormValues(),
    refineCoreProps: {
      queryOptions: {
        // Fresh data on every open, so the extra-fields array starts from the
        // stored value rather than a stale cache entry.
        cacheTime: 0,
        // The form edits a converted shape (GiB, key/value rows, auth "none");
        // toLogSinkFormValues is the inverse of toLogSinkSpec.
        // `id` rides along for the connection test; it is not a form field.
        select: (response) => ({
          ...response,
          data: {
            ...toLogSinkFormValues(response.data as LogSink),
            id: (response.data as LogSink).id,
          } as unknown as LogSink,
        }),
      },
      onMutationError: (error) => {
        const field = LOG_SINK_ERROR_FIELDS[String(error?.code ?? "")];
        if (field) {
          form.setError(field, {
            type: "server",
            message: error.message,
          });
        }
      },
    },
    warnWhenUnsavedChanges: true,
  });

  const stored = form.refineCore.query?.data?.data as unknown as
    | (LogSinkFormValues & { id: number })
    | undefined;
  const storedAuthType = stored?.spec.victorialogs.auth.type;

  const connectionTest = useLogSinkTestConnection();
  const { reset: resetConnectionTest } = connectionTest;
  // A result describes the values it was run with; drop it once they change.
  useEffect(() => {
    const subscription = form.watch(() => resetConnectionTest());
    return () => subscription.unsubscribe();
  }, [form.watch, resetConnectionTest]);
  const runConnectionTest = () => {
    const values = form.getValues() as LogSinkFormValues;
    if (isEdit) {
      if (stored?.id === undefined) return;
      connectionTest.test({ mode: "edit", id: stored.id, values });
    } else {
      connectionTest.test({ mode: "create", values });
    }
  };

  const originalOnFinish = form.refineCore.onFinish;
  form.refineCore.onFinish = async (values) =>
    originalOnFinish(toLogSinkPayload(values as LogSinkFormValues, action));

  const {
    fields: extraFieldRows,
    append: appendExtraField,
    remove: removeExtraField,
  } = useRefineFieldArray({
    control: form.control,
    name: "spec.victorialogs.extra_fields",
    refineForm: form,
  });

  const authType = form.watch("spec.victorialogs.auth.type");
  const enabled = form.watch("spec.enabled");
  const skipVerify = form.watch("spec.victorialogs.insecure_skip_verify");
  // A stored bearer token can be kept by leaving the input blank; otherwise
  // there is nothing to keep and a token is required.
  const tokenRequired = !isEdit || storedAuthType !== "bearer";
  const keepSecretHint = isEdit
    ? t("common.messages.leaveEmptyToKeepValue")
    : undefined;

  const urlMessages = {
    required: t("log_sinks.validation.urlRequired"),
    scheme: t("log_sinks.validation.urlScheme"),
    invalid: t("log_sinks.validation.urlInvalid"),
    host: t("log_sinks.validation.urlHost"),
    queryOrFragment: t("log_sinks.validation.urlQueryOrFragment"),
  };
  const extraKeyMessages = {
    required: t("log_sinks.validation.extraFieldKeyRequired"),
    invalidChars: t("log_sinks.validation.extraFieldKeyInvalid"),
    duplicate: t("log_sinks.validation.extraFieldKeyDuplicate"),
  };

  return {
    form,
    metadataFields: (
      <FormCardGrid title={t("common.sections.basicInformation")}>
        <FormFieldGroup
          {...form}
          name="metadata.name"
          label={t("common.fields.name")}
          required
          rules={{
            required: t("log_sinks.validation.nameRequired"),
            pattern: {
              value: NAME_PATTERN,
              message: t("log_sinks.validation.namePattern"),
            },
          }}
        >
          <Input
            placeholder={t("log_sinks.placeholders.name")}
            disabled={isEdit}
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.enabled"
          label={t("log_sinks.fields.enabled")}
          description={t("log_sinks.descriptions.enabled")}
          isCheckbox
          className="col-span-4"
        >
          <Switch
            checked={enabled === true}
            onCheckedChange={(checked) =>
              form.setValue("spec.enabled", checked, {
                shouldDirty: true,
              })
            }
          />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    specFields: (
      <>
        <FormCardGrid title={t("log_sinks.sections.destination")}>
          <FormFieldGroup
            {...form}
            name="spec.type"
            label={t("log_sinks.fields.type")}
            required
          >
            <FormSelect
              disabled={isEdit}
              options={[
                {
                  label: t("log_sinks.types.victorialogs"),
                  value: "victorialogs",
                },
              ]}
            />
          </FormFieldGroup>
          <FormFieldGroup
            {...form}
            name="spec.victorialogs.url"
            label={t("log_sinks.fields.url")}
            required
            className="col-span-3"
            rules={{
              validate: (value: string) => {
                const error = validateSinkUrl(value);
                return error ? urlMessages[error] : true;
              },
            }}
          >
            <Input placeholder={t("log_sinks.placeholders.url")} />
          </FormFieldGroup>
          <FormFieldGroup
            {...form}
            name="spec.victorialogs.auth.type"
            label={t("log_sinks.fields.authType")}
          >
            <FormSelect
              options={(["none", "basic", "bearer"] as const).map((type) => ({
                label: t(`log_sinks.authTypes.${type}`),
                value: type,
              }))}
            />
          </FormFieldGroup>
          {authType === "basic" && (
            <>
              <FormFieldGroup
                {...form}
                name="spec.victorialogs.auth.username"
                label={t("log_sinks.fields.username")}
                required
                rules={{
                  validate: (value: string) =>
                    value.trim() !== "" ||
                    t("log_sinks.validation.usernameRequired"),
                }}
              >
                <Input autoComplete="off" />
              </FormFieldGroup>
              <FormFieldGroup
                {...form}
                name="spec.victorialogs.auth.password"
                label={t("log_sinks.fields.password")}
                description={keepSecretHint}
              >
                <Input type="password" autoComplete="new-password" />
              </FormFieldGroup>
            </>
          )}
          {authType === "bearer" && (
            <FormFieldGroup
              {...form}
              name="spec.victorialogs.auth.token"
              label={t("log_sinks.fields.token")}
              required={tokenRequired}
              description={tokenRequired ? undefined : keepSecretHint}
              className="col-span-2"
              rules={{
                validate: (value: string) =>
                  !tokenRequired ||
                  value.trim() !== "" ||
                  t("log_sinks.validation.tokenRequired"),
              }}
            >
              <Input type="password" autoComplete="new-password" />
            </FormFieldGroup>
          )}
          <div className="col-span-4">
            <TestConnectionButton
              testing={connectionTest.testing}
              result={connectionTest.result}
              onTest={runConnectionTest}
            />
          </div>
        </FormCardGrid>
        <FormCardGrid title={t("log_sinks.sections.advanced")}>
          <FormFieldGroup
            {...form}
            name="spec.victorialogs.timeout_seconds"
            label={t("log_sinks.fields.timeoutSeconds")}
            description={t("log_sinks.descriptions.timeoutSeconds")}
            rules={{
              validate: (value: string) =>
                !validateTimeoutSeconds(value) ||
                t("log_sinks.validation.timeoutInvalid"),
            }}
          >
            <Input
              inputMode="numeric"
              placeholder={t("log_sinks.placeholders.timeoutSeconds")}
            />
          </FormFieldGroup>
          <FormFieldGroup
            {...form}
            name="spec.buffer.max_size_gib"
            label={t("log_sinks.fields.bufferSize")}
            description={t("log_sinks.descriptions.bufferSize")}
            rules={{
              validate: (value: string) => {
                const error = validateBufferGib(value);
                if (error === "min") return t("log_sinks.validation.bufferMin");
                if (error) return t("log_sinks.validation.bufferInvalid");
                return true;
              },
            }}
          >
            <Input
              inputMode="decimal"
              placeholder={t("log_sinks.placeholders.bufferSize")}
            />
          </FormFieldGroup>
          <FormFieldGroup
            {...form}
            name="spec.victorialogs.insecure_skip_verify"
            label={t("log_sinks.fields.insecureSkipVerify")}
            description={t("log_sinks.descriptions.insecureSkipVerify")}
            isCheckbox
            className="col-span-4"
          >
            <Checkbox
              checked={skipVerify === true}
              onCheckedChange={(checked) =>
                form.setValue(
                  "spec.victorialogs.insecure_skip_verify",
                  checked === true,
                  { shouldDirty: true },
                )
              }
            />
          </FormFieldGroup>
          <FormFieldGroup
            {...form}
            name="spec.victorialogs.ca_cert"
            label={t("log_sinks.fields.caCert")}
            className="col-span-4"
          >
            <Textarea
              rows={4}
              className="font-mono text-xs"
              placeholder={t("log_sinks.placeholders.caCert")}
            />
          </FormFieldGroup>
          <div className="col-span-4 space-y-2">
            <div className="text-sm leading-[22px] text-[var(--nt-text-neutral-secondary)]">
              {t("log_sinks.fields.extraFields")}
            </div>
            <div className="text-sm text-muted-foreground">
              {t("log_sinks.descriptions.extraFields")}
            </div>
            {extraFieldRows.map((row, index) => (
              <div key={row.id} className="flex items-start gap-3">
                <FormFieldGroup
                  {...form}
                  name={`spec.victorialogs.extra_fields.${index}.key`}
                  className="flex-1"
                  rules={{
                    validate: (_: string, values) => {
                      const error = validateExtraFieldKey(
                        (values as LogSinkFormValues).spec.victorialogs
                          .extra_fields,
                        index,
                      );
                      return error ? extraKeyMessages[error] : true;
                    },
                  }}
                >
                  <Input
                    aria-label={t("log_sinks.fields.extraFieldKey")}
                    placeholder={t("log_sinks.fields.extraFieldKey")}
                  />
                </FormFieldGroup>
                <FormFieldGroup
                  {...form}
                  name={`spec.victorialogs.extra_fields.${index}.value`}
                  className="flex-1"
                  rules={{
                    validate: (value: string) =>
                      !validateExtraFieldValue(value) ||
                      t("log_sinks.validation.extraFieldValueComma"),
                  }}
                >
                  <Input
                    aria-label={t("log_sinks.fields.extraFieldValue")}
                    placeholder={t("log_sinks.fields.extraFieldValue")}
                  />
                </FormFieldGroup>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title={t("log_sinks.buttons.removeExtraField")}
                  onClick={() => removeExtraField(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendExtraField({ key: "", value: "" })}
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("log_sinks.buttons.addExtraField")}
            </Button>
          </div>
        </FormCardGrid>
      </>
    ),
  };
};
