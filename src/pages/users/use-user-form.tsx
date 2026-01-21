import FormCardGrid from "@/components/business/FormCardGrid";
import { Field } from "@/components/theme";
import { Input } from "@/components/ui/input";
import type { UserProfile } from "@/types";
import { useTranslation } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";

export const useUserForm = ({ action }: { action: "create" | "edit" }) => {
  const isEdit = action === "edit";
  const { translate } = useTranslation();

  const form = useForm<UserProfile>({
    mode: "all",
    defaultValues: isEdit
      ? {
          api_version: "v1",
          kind: "UserProfile",
          metadata: {
            name: "",
          },
          spec: {
            email: "",
          },
        }
      : {
          name: "",
          email: "",
          password: "",
          confirmPassword: "",
        },
    refineCoreProps: {},
    warnWhenUnsavedChanges: true,
  });

  return {
    form,
    registerFields: isEdit ? null : (
      <FormCardGrid>
        <Field {...form} name="name" label={translate("common.fields.name")}>
          <Input
            placeholder={translate("user_profiles.placeholders.userName")}
          />
        </Field>
        <Field {...form} name="email" label={translate("common.fields.email")}>
          <Input
            placeholder={translate("user_profiles.placeholders.userEmail")}
            type="email"
          />
        </Field>
        <div className="col-span-2" />
        <Field
          {...form}
          label={translate("common.fields.password")}
          {...form.register("password", {
            minLength: {
              value: 6,
              message: translate("user_profiles.validation.passwordMinLength"),
            },
          })}
        >
          <Input type="password" />
        </Field>
        <Field
          {...form}
          label={translate("user_profiles.fields.confirmPassword")}
          {...form.register("confirmPassword", {
            required: {
              value: true,
              message: translate("pages.auth.errors.confirmPasswordRequired"),
            },
            validate: (value: string) => {
              return (
                value === form.getValues("password") ||
                translate("pages.auth.errors.confirmPasswordNotMatch")
              );
            },
          })}
        >
          <Input type="password" />
        </Field>
      </FormCardGrid>
    ),
    metadataFields: (
      <FormCardGrid title={translate("common.sections.basicInformation")}>
        <Field
          {...form}
          name="metadata.name"
          label={translate("common.fields.name")}
        >
          <Input
            placeholder={translate("user_profiles.placeholders.userName")}
            disabled={isEdit}
          />
        </Field>
      </FormCardGrid>
    ),
    specFields: (
      <FormCardGrid>
        <Field
          {...form}
          name="spec.email"
          label={translate("common.fields.email")}
        >
          <Input type="email" />
        </Field>
      </FormCardGrid>
    ),
  };
};
