import { useWorkspace } from "@/components/theme/hooks";
import { useForm } from "@refinedev/react-hook-form";
import { Field, Select } from "@/components/theme";
import type { ModelRegistry } from "@/types";
import FormCardGrid from "@/components/business/FormCardGrid";
import { Input } from "@/components/ui/input";
import WorkspaceField from "@/components/business/WorkspaceField";
import { useTranslation } from "@/lib/i18n";
import { PRIVATE_MODEL_REGISTRY_TYPE } from "@/lib/constant";

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
    refineCoreProps: {
      autoSave: {
        enabled: true,
      },
    },
    warnWhenUnsavedChanges: true,
  });

  const currentType: ModelRegistry["spec"]["type"] = form.watch("spec.type");

  const isEdit = action === "edit";

  return {
    form,
    metadataFields: (
      <FormCardGrid title={t("model_registries.fields.basicInformation")}>
        <Field
          {...form}
          name="metadata.name"
          label={t("model_registries.fields.name")}
        >
          <Input
            placeholder={t("model_registries.placeholders.registryName")}
            disabled={isEdit}
          />
        </Field>
        <Field
          {...form}
          name="metadata.workspace"
          label={t("model_registries.fields.workspace")}
        >
          <WorkspaceField disabled={isEdit} />
        </Field>
      </FormCardGrid>
    ),
    specFields: (
      <FormCardGrid title={t("model_registries.fields.modelRegistry")}>
        <Field
          {...form}
          name="spec.type"
          label={t("model_registries.fields.type")}
        >
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
          name="spec.url"
          label={t("model_registries.fields.url")}
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
          description={t("model_registries.descriptions.credentials")}
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
