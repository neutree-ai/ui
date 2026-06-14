import { useList } from "@refinedev/core";
import { Plus, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ENDPOINT_TYPES,
  type EndpointType,
  QUOTA_PERIODS,
  RATE_WINDOWS,
} from "@/domains/api-key/hooks/use-api-key-policy";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { useRefineFieldArray } from "@/foundation/hooks/use-refine-field-array";

type NamedLite = { id: string | number; metadata?: { name?: string } };

type ApiKeyPolicyFieldsProps = {
  // The react-hook-form instance whose values include the policy fields.
  // biome-ignore lint/suspicious/noExplicitAny: shared across forms with extra fields.
  form: UseFormReturn<any>;
  // Workspace whose endpoints populate the endpoint-allowlist name options.
  workspace: string;
};

// Two collapsible-free sections (Quota + Access) embedded in the API key
// create/edit flow. Every limit is optional.
export const ApiKeyPolicyFields = ({
  form,
  workspace,
}: ApiKeyPolicyFieldsProps) => {
  const { t } = useTranslation();
  const modelsArray = useRefineFieldArray({
    control: form.control,
    name: "models",
  });
  const endpointsArray = useRefineFieldArray({
    control: form.control,
    name: "endpoints",
  });
  const endpoints = form.watch("endpoints");

  const { data: endpointsData } = useList<NamedLite>({
    resource: "endpoints",
    pagination: { mode: "off" },
    meta: { workspace },
    queryOptions: { enabled: !!workspace },
  });
  const { data: extEndpointsData } = useList<NamedLite>({
    resource: "external_endpoints",
    pagination: { mode: "off" },
    meta: { workspace },
    queryOptions: { enabled: !!workspace },
  });
  const toNameOptions = (data?: { data?: NamedLite[] }) =>
    (data?.data ?? [])
      .map((d) => d.metadata?.name)
      .filter((n): n is string => !!n)
      .map((n) => ({ label: n, value: n }));
  const epNameOptions = (et: EndpointType | undefined) =>
    et === "external_endpoint"
      ? toNameOptions(extEndpointsData)
      : toNameOptions(endpointsData);

  return (
    <div className="space-y-3">
      {/* Token quota */}
      <div className="space-y-2 rounded-md border p-3">
        <div className="text-sm font-medium">
          {t("api_keys.limits.quotaTitle")}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("api_keys.limits.quotaHint")}
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FormFieldGroup
              {...form}
              name="quota_limit"
              label={t("api_keys.limits.tokenLimit")}
            >
              <Input
                type="number"
                min={0}
                placeholder={t("api_keys.limits.optional")}
              />
            </FormFieldGroup>
          </div>
          <div className="w-36">
            <FormFieldGroup
              {...form}
              name="quota_period"
              label={t("api_keys.limits.period")}
            >
              <FormCombobox
                options={QUOTA_PERIODS.map((p) => ({
                  label: t(`api_keys.limits.periods.${p}`),
                  value: p,
                }))}
              />
            </FormFieldGroup>
          </div>
        </div>
      </div>

      {/* Access control */}
      <div className="space-y-3 rounded-md border p-3">
        <div className="text-sm font-medium">
          {t("api_keys.limits.accessTitle")}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FormFieldGroup
              {...form}
              name="rate_limit"
              label={t("api_keys.limits.rateLimit")}
            >
              <Input
                type="number"
                min={0}
                placeholder={t("api_keys.limits.optional")}
              />
            </FormFieldGroup>
          </div>
          <div className="w-36">
            <FormFieldGroup
              {...form}
              name="rate_window"
              label={t("api_keys.limits.window")}
            >
              <FormCombobox
                options={RATE_WINDOWS.map((w) => ({
                  label: t(`api_keys.limits.windows.${w}`),
                  value: w,
                }))}
              />
            </FormFieldGroup>
          </div>
        </div>

        <FormFieldGroup
          {...form}
          name="concurrency"
          label={t("api_keys.limits.concurrency")}
        >
          <Input
            type="number"
            min={0}
            placeholder={t("api_keys.limits.optional")}
          />
        </FormFieldGroup>

        {/* Allowed models */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">{t("api_keys.limits.allowedModels")}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => modelsArray.append({ value: "" })}
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("api_keys.limits.addModel")}
            </Button>
          </div>
          {modelsArray.fields.map((field, index) => (
            <div key={field.id} className="flex items-end gap-2">
              <div className="flex-1">
                <FormFieldGroup
                  {...form}
                  name={`models.${index}.value`}
                  rules={{ required: true }}
                >
                  <Input placeholder={t("api_keys.limits.modelName")} />
                </FormFieldGroup>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mb-1"
                title={t("buttons.delete")}
                onClick={() => modelsArray.remove(index)}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
        </div>

        {/* Allowed endpoints */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {t("api_keys.limits.allowedEndpoints")}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                endpointsArray.append({ type: "endpoint", name: "" })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("api_keys.limits.addEndpoint")}
            </Button>
          </div>
          {endpointsArray.fields.map((field, index) => {
            const et = (endpoints?.[index]?.type ??
              (field as unknown as { type?: EndpointType }).type) as
              | EndpointType
              | undefined;
            return (
              <div key={field.id} className="flex items-end gap-2">
                <div className="w-40">
                  <FormFieldGroup {...form} name={`endpoints.${index}.type`}>
                    <FormCombobox
                      options={ENDPOINT_TYPES.map((e) => ({
                        label: t(`api_keys.limits.endpointTypes.${e}`),
                        value: e,
                      }))}
                    />
                  </FormFieldGroup>
                </div>
                <div className="flex-1">
                  <FormFieldGroup
                    {...form}
                    name={`endpoints.${index}.name`}
                    rules={{ required: true }}
                  >
                    <FormCombobox
                      placeholder={t("api_keys.limits.selectEndpoint")}
                      options={epNameOptions(et)}
                    />
                  </FormFieldGroup>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mb-1"
                  title={t("buttons.delete")}
                  onClick={() => endpointsArray.remove(index)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
