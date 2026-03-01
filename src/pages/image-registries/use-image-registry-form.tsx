import { Input } from "@/components/ui/input";
import type { ImageRegistry } from "@/domains/image-registry/types";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import WorkspaceField from "@/foundation/components/WorkspaceField";
import { useWorkspace } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";
import { useForm } from "@refinedev/react-hook-form";

const transformValues = (values: ImageRegistry, isEdit = false) => {
  const transformedValues = { ...values };

  // In edit mode, remove empty sensitive fields to avoid overwriting backend config
  if (isEdit && transformedValues.spec?.authconfig) {
    const authconfig = transformedValues.spec.authconfig;
    if (!authconfig.username) {
      delete authconfig.username;
    }
    if (!authconfig.password) {
      delete authconfig.password;
    }
  }

  return transformedValues;
};

export const useImageRegistryForm = ({
  action,
}: {
  action: "create" | "edit";
}) => {
  const { t } = useTranslation();
  const { current: currentWorkspace } = useWorkspace();
  const form = useForm<ImageRegistry>({
    mode: "all",
    defaultValues: {
      api_version: "v1",
      kind: "ImageRegistry",
      metadata: {
        name: "",
        workspace: currentWorkspace,
      },
      spec: {
        url: "",
        repository: "",
        authconfig: {
          username: "",
          password: "",
        },
      },
    },
    refineCoreProps: {},
    warnWhenUnsavedChanges: true,
  });

  const isEdit = action === "edit";

  const originalOnFinish = form.refineCore.onFinish;
  form.refineCore.onFinish = async (values) => {
    const transformedValues = transformValues(values as ImageRegistry, isEdit);

    return originalOnFinish(transformedValues);
  };

  return {
    form,
    metadataFields: (
      <FormCardGrid title={t("common.sections.basicInformation")}>
        <FormFieldGroup
          {...form}
          label={t("common.fields.name")}
          {...form.register("metadata.name", {
            required: {
              value: true,
              message: t("image_registries.validation.nameRequired"),
            },
          })}
        >
          <Input
            placeholder={t("image_registries.placeholders.registryName")}
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
      <>
        <FormCardGrid title={t("common.fields.imageRegistry")}>
          <FormFieldGroup
            {...form}
            name="spec.url"
            label={t("image_registries.fields.url")}
          >
            <Input placeholder={t("image_registries.placeholders.dockerUrl")} />
          </FormFieldGroup>
          <FormFieldGroup
            {...form}
            name="spec.repository"
            label={t("image_registries.fields.repository")}
          >
            <Input />
          </FormFieldGroup>
        </FormCardGrid>
        <FormCardGrid title={t("image_registries.fields.authentication")}>
          <FormFieldGroup
            {...form}
            name="spec.authconfig.username"
            label={t("image_registries.fields.username")}
            description={
              isEdit ? t("common.messages.leaveEmptyToKeepValue") : undefined
            }
          >
            <Input />
          </FormFieldGroup>
          <FormFieldGroup
            {...form}
            name="spec.authconfig.password"
            label={t("image_registries.fields.password")}
            description={
              isEdit ? t("common.messages.leaveEmptyToKeepValue") : undefined
            }
          >
            <Input type="password" />
          </FormFieldGroup>
        </FormCardGrid>
      </>
    ),
  };
};
