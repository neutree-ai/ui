import { Input } from "@/components/ui/input";
import { transformModelRegistryValues } from "@/domains/model-registry/lib/transform-model-registry-values";
import type { ModelRegistry } from "@/domains/model-registry/types";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { FormSelect } from "@/foundation/components/FormSelect";
import WorkspaceField from "@/foundation/components/WorkspaceField";
import { useWorkspace } from "@/foundation/hooks/use-workspace";
import { PRIVATE_MODEL_REGISTRY_TYPE } from "@/foundation/lib/constant";
import { useTranslation } from "@/foundation/lib/i18n";
import { isNfsProtocol } from "@/foundation/lib/validate";
import { useForm } from "@refinedev/react-hook-form";

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
    const transformedValues = transformModelRegistryValues(
      values as ModelRegistry,
      isEdit,
    );

    return originalOnFinish(transformedValues);
  };

  return {
    form,
    metadataFields: (
      <FormCardGrid title={t("common.sections.basicInformation")}>
        <FormFieldGroup
          {...form}
          name="metadata.name"
          label={t("common.fields.name")}
        >
          <Input
            placeholder={t("model_registries.placeholders.registryName")}
            disabled={isEdit}
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="metadata.workspace"
          label={t("common.fields.workspace")}
        >
          <WorkspaceField disabled={isEdit} />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    specFields: (
      <FormCardGrid title={t("model_registries.fields.modelRegistry")}>
        <FormFieldGroup
          {...form}
          name="spec.type"
          label={t("common.fields.type")}
        >
          <FormSelect
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
        </FormFieldGroup>
        <FormFieldGroup
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
        </FormFieldGroup>
        <FormFieldGroup
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
        </FormFieldGroup>
      </FormCardGrid>
    ),
  };
};
