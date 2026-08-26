import { useForm } from "@refinedev/react-hook-form";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_MODEL_REGISTRY_TYPE,
  modelRegistryTypeOptions,
  modelRegistryUrlPlaceholder,
} from "@/domains/model-registry/components/ModelRegistryType";
import { transformModelRegistryValues } from "@/domains/model-registry/lib/transform-model-registry-values";
import type { ModelRegistry } from "@/domains/model-registry/types";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { FormSelect } from "@/foundation/components/FormSelect";
import WorkspaceField from "@/foundation/components/WorkspaceField";
import {
  isValidWorkspace,
  useWorkspace,
} from "@/foundation/hooks/use-workspace";
import { PRIVATE_MODEL_REGISTRY_TYPE } from "@/foundation/lib/constant";
import { useTranslation } from "@/foundation/lib/i18n";
import { isNfsProtocol } from "@/foundation/lib/validate";

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
        workspace: isValidWorkspace(currentWorkspace) ? currentWorkspace : "",
      },
      spec: {
        url: "",
        type: DEFAULT_MODEL_REGISTRY_TYPE,
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
      form.formState.touchedFields,
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
          rules={{
            required: t("common.validation.workspaceRequired"),
            validate: (value: string) =>
              isValidWorkspace(value) ||
              t("common.validation.workspaceRequired"),
          }}
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
            options={modelRegistryTypeOptions(t)}
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
              // A file system registry names a mount, and only nfs:// mounts can
              // be reached from every node. Every other kind is addressed by a
              // hub URL the control plane has to resolve for itself, so there is
              // nothing to check here that the connection attempt does not.
              if (currentType === PRIVATE_MODEL_REGISTRY_TYPE) {
                if (!value) return true; // Let required rule handle empty
                return (
                  isNfsProtocol(value) ||
                  t("model_registries.validation.mustUseNfsProtocol")
                );
              }
              return true;
            },
          })}
        >
          <Input placeholder={modelRegistryUrlPlaceholder(currentType, t)} />
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
