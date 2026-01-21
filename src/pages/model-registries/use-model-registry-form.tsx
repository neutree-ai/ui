import FormCardGrid from "@/components/business/FormCardGrid";
import WorkspaceField from "@/components/business/WorkspaceField";
import { Field, Select } from "@/components/theme";
import { useWorkspace } from "@/components/theme/hooks";
import { Input } from "@/components/ui/input";
import { PRIVATE_MODEL_REGISTRY_TYPE } from "@/lib/constant";
import { useTranslation } from "@/lib/i18n";
import { isNfsProtocol } from "@/lib/validate";
import type { ModelRegistry } from "@/types";
import { useForm } from "@refinedev/react-hook-form";

export const transformValues = (values: ModelRegistry, isEdit = false) => {
  const transformedValues = { ...values };

  // In edit mode, remove empty sensitive fields to avoid overwriting backend config
  if (isEdit && transformedValues.spec) {
    if (!transformedValues.spec.credentials) {
      delete transformedValues.spec.credentials;
    }
  }

  return transformedValues;
};

export const useModelRegistryForm = ({
  action,
}: {
  action: "create" | "edit";
}) => {
  const { t } = useTranslation();
  const { current: currentWorkspace } = useWorkspace();
  const form = useForm<ModelRegistry>({
    mode: "all",
    defaultValues: {
      api_version: "v1",
      kind: "ModelRegistry",
      metadata: {
        name: "",
        workspace: currentWorkspace,
      },
      spec: {
        url: "",
        type: "hugging-face",
        credentials: "",
      },
    },
    refineCoreProps: {},
    warnWhenUnsavedChanges: true,
  });

  const currentType: ModelRegistry["spec"]["type"] = form.watch("spec.type");

  const isEdit = action === "edit";

  const originalOnFinish = form.refineCore.onFinish;
  form.refineCore.onFinish = async (values) => {
    const transformedValues = transformValues(values as ModelRegistry, isEdit);

    return originalOnFinish(transformedValues);
  };

  return {
    form,
    metadataFields: (
      <FormCardGrid title={t("common.sections.basicInformation")}>
        <Field {...form} name="metadata.name" label={t("common.fields.name")}>
          <Input
            placeholder={t("model_registries.placeholders.registryName")}
            disabled={isEdit}
          />
        </Field>
        <Field
          {...form}
          name="metadata.workspace"
          label={t("common.fields.workspace")}
        >
          <WorkspaceField disabled={isEdit} />
        </Field>
      </FormCardGrid>
    ),
    specFields: (
      <FormCardGrid title={t("model_registries.fields.modelRegistry")}>
        <Field {...form} name="spec.type" label={t("common.fields.type")}>
          <Select
            placeholder={t("model_registries.placeholders.selectType")}
            options={[
              {
                label: t("model_registries.types.huggingFace"),
                value: "hugging-face",
              },
              {
                label: t("model_registries.types.fileSystem"),
                value: PRIVATE_MODEL_REGISTRY_TYPE,
              },
            ]}
          />
        </Field>
        <Field
          {...form}
          label={t("model_registries.fields.url")}
          {...form.register("spec.url", {
            required: {
              value: true,
              message: t("model_registries.validation.urlRequired"),
            },
            validate: (value: string) => {
              // Only validate protocol for file system type
              if (currentType === PRIVATE_MODEL_REGISTRY_TYPE) {
                if (!value) return true; // Let required rule handle empty
                return (
                  isNfsProtocol(value) ||
                  t("model_registries.validation.mustUseNfsProtocol")
                );
              }
              return true; // No validation for hugging-face type
            },
          })}
        >
          <Input
            placeholder={
              currentType === "hugging-face"
                ? t("model_registries.placeholders.huggingFaceUrl")
                : t("model_registries.placeholders.fileSystemUrl")
            }
          />
        </Field>
        <Field
          {...form}
          name="spec.credentials"
          label={t("model_registries.fields.credentials")}
          description={
            isEdit
              ? t("common.messages.leaveEmptyToKeepValue")
              : t("model_registries.descriptions.credentials")
          }
          className="col-span-4"
        >
          <Input
            placeholder={t("model_registries.placeholders.credentials")}
            type="password"
          />
        </Field>
      </FormCardGrid>
    ),
  };
};
