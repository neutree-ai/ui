import FormCardGrid from "@/components/business/FormCardGrid";
import WorkspaceField from "@/components/business/WorkspaceField";
import { Field, Select } from "@/components/theme";
import { useWorkspace } from "@/components/theme/hooks";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n";
import type { ImageRegistry } from "@/types";
import { useForm } from "@refinedev/react-hook-form";

export const transformValues = (values: ImageRegistry, isEdit = false) => {
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
    if (!authconfig.auth) {
      delete authconfig.auth;
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
          auth: "",
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
        <Field {...form} name="metadata.name" label={t("common.fields.name")}>
          <Input
            placeholder={t("image_registries.placeholders.registryName")}
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
      <>
        <FormCardGrid title={t("common.fields.imageRegistry")}>
          <Field
            {...form}
            name="spec.url"
            label={t("image_registries.fields.url")}
          >
            <Input placeholder={t("image_registries.placeholders.dockerUrl")} />
          </Field>
          <Field
            {...form}
            name="spec.repository"
            label={t("image_registries.fields.repository")}
          >
            <Input />
          </Field>
        </FormCardGrid>
        <FormCardGrid title={t("image_registries.fields.authentication")}>
          <Field
            {...form}
            name="spec.authconfig.username"
            label={t("image_registries.fields.username")}
            description={
              isEdit ? t("common.messages.leaveEmptyToKeepValue") : undefined
            }
          >
            <Input />
          </Field>
          <Field
            {...form}
            name="spec.authconfig.password"
            label={t("image_registries.fields.password")}
            description={
              isEdit ? t("common.messages.leaveEmptyToKeepValue") : undefined
            }
          >
            <Input type="password" />
          </Field>
          <div className="col-span-2" />

          <Field
            {...form}
            name="spec.authconfig.auth"
            label={t("image_registries.fields.base64Auth")}
            description={
              isEdit
                ? t("common.messages.leaveEmptyToKeepValue")
                : t("image_registries.descriptions.base64Auth")
            }
            className="col-span-4"
          >
            <Input type="password" />
          </Field>
        </FormCardGrid>
      </>
    ),
  };
};
